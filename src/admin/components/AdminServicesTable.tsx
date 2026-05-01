export interface AdminService {
  id: string;
  title: string;
  sellerName: string;
  price: number;
  status: string;
}

interface Props {
  services: AdminService[];
  loading: boolean;
}

const SkeletonRow = ({ cols }: { cols: number }) => (
  <tr className="border-b border-slate-800/50">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-5 py-3">
        <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 20}px` }} />
      </td>
    ))}
  </tr>
);

const AdminServicesTable = ({ services, loading }: Props) => (
  <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-white">Recent Services</h3>
      {!loading && (
        <span className="text-xs text-slate-500">{services.length} shown</span>
      )}
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {['Title', 'Seller', 'Price', 'Status'].map((h) => (
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
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
            : services.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-5 py-3 text-white font-medium max-w-[220px] truncate">
                    {s.title || '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-400">{s.sellerName || '—'}</td>
                  <td className="px-5 py-3 text-slate-300">${s.price.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        s.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {s.status || 'active'}
                    </span>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>

      {!loading && services.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-8">No services found</p>
      )}
    </div>
  </div>
);

export default AdminServicesTable;
